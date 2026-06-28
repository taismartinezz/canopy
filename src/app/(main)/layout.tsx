import AppShell from "@/components/layout/AppShell";
import { ProjectProvider } from "@/context/ProjectContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectProvider>
      <AppShell>{children}</AppShell>
    </ProjectProvider>
  );
}
