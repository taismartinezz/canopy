// Server-side proxy for OpenAlex related-works recommendations with DB-level caching.
// Caches results per source item for CACHE_TTL_HOURS to avoid hammering OpenAlex.

import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const CACHE_TTL_HOURS = 24;

interface RecResult {
  title: string;
  authors: string[];
  year?: number;
  journal?: string;
  doi?: string;
  openAlexId: string;
}

export async function POST(request: Request) {
  const { doi, sourceItemId, projectId } = (await request.json()) as {
    doi?: string;
    sourceItemId?: string;
    projectId?: string;
  };

  if (!doi || !sourceItemId || !projectId) {
    return Response.json({ recommendations: [] });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ recommendations: [] });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Check cache — return if fresh enough
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3600 * 1000).toISOString();
  const { data: cached } = await supabase
    .from("lit_recommendation_cache")
    .select("*")
    .eq("source_item_id", sourceItemId)
    .eq("project_id", projectId)
    .gt("cached_at", cutoff)
    .order("cached_at", { ascending: false });

  if (cached && cached.length > 0) {
    return Response.json({
      recommendations: cached.map((r) => ({
        title: r.title as string,
        authors: (r.authors as string[]) ?? [],
        year: r.year as number | undefined,
        journal: r.journal as string | undefined,
        doi: r.doi as string | undefined,
        openAlexId: r.open_alex_id as string,
      })),
      fromCache: true,
    });
  }

  // Fetch from OpenAlex
  try {
    const workRes = await fetch(
      `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`,
      { headers: { "User-Agent": "Canopy/1.0 (research-lab-app; mailto:admin@canopy.app)" } }
    );
    if (!workRes.ok) return Response.json({ recommendations: [] });

    const work = await workRes.json() as { related_works?: string[] };
    const relatedIds: string[] = (work.related_works ?? []).slice(0, 10);
    if (!relatedIds.length) return Response.json({ recommendations: [] });

    const recsRes = await fetch(
      `https://api.openalex.org/works?filter=ids.openalex:${encodeURIComponent(relatedIds.join("|"))}&per_page=5&select=id,display_name,authorships,publication_year,primary_location,doi`,
      { headers: { "User-Agent": "Canopy/1.0 (research-lab-app; mailto:admin@canopy.app)" } }
    );
    if (!recsRes.ok) return Response.json({ recommendations: [] });

    const { results = [] } = await recsRes.json() as {
      results: Array<{
        id: string; display_name: string;
        authorships?: Array<{ author: { display_name: string } }>;
        publication_year?: number;
        primary_location?: { source?: { display_name?: string } };
        doi?: string;
      }>;
    };

    const recommendations: RecResult[] = results.map((w) => ({
      title: w.display_name,
      authors: (w.authorships ?? []).slice(0, 3).map((a) => a.author.display_name),
      year: w.publication_year,
      journal: w.primary_location?.source?.display_name,
      doi: w.doi?.replace("https://doi.org/", ""),
      openAlexId: w.id,
    }));

    // Delete stale cache entries for this item before inserting fresh ones
    await supabase
      .from("lit_recommendation_cache")
      .delete()
      .eq("source_item_id", sourceItemId)
      .eq("project_id", projectId);

    if (recommendations.length > 0) {
      await supabase.from("lit_recommendation_cache").insert(
        recommendations.map((r) => ({
          source_item_id: sourceItemId,
          project_id: projectId,
          title: r.title,
          authors: r.authors,
          year: r.year ?? null,
          journal: r.journal ?? null,
          doi: r.doi ?? null,
          open_alex_id: r.openAlexId,
          dismissed: false,
        }))
      );
    }

    return Response.json({ recommendations, fromCache: false });
  } catch {
    return Response.json({ recommendations: [] });
  }
}
