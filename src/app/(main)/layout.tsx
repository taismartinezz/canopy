import AppShell from "@/components/layout/AppShell";
import { ProjectProvider } from "@/context/ProjectContext";
import { DensityProvider } from "@/context/DensityContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <DensityProvider>
        <AppShell>{children}</AppShell>
      </DensityProvider>
    </ProjectProvider>
  );
}
