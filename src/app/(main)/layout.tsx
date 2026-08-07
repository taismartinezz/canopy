import AppShell from "@/components/layout/AppShell";
import { ProjectProvider } from "@/context/ProjectContext";
import { DensityProvider } from "@/context/DensityContext";
import { ThemeProvider } from "@/context/ThemeContext";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <DensityProvider>
          <AppShell>{children}</AppShell>
        </DensityProvider>
      </ProjectProvider>
    </ThemeProvider>
  );
}
