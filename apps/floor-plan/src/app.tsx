import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas } from '@/components/canvas';
import { Sidebar } from '@/components/Sidebar/sidebar';
import { useRoomPlanner } from '@/hooks/use-floor-planner';
import type { PlannerProjectsReturn } from '@/hooks/use-planner-projects';
import { usePlannerProjects } from '@/hooks/use-planner-projects';
import { ThemeProvider, useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

function PlannerWorkspace({ projects }: { projects: PlannerProjectsReturn }) {
  const { activeProject, activeSnapshot, updateSnapshotState } = projects;
  const activeLayoutKey = `${activeProject.id}:${activeSnapshot.id}`;
  const planner = useRoomPlanner(
    projects.activeSnapshot.state,
    activeLayoutKey,
  );
  const lastLoadedLayoutKeyRef = useRef(activeLayoutKey);
  const [canvasLayoutKey, setCanvasLayoutKey] = useState(activeLayoutKey);

  useLayoutEffect(() => {
    if (lastLoadedLayoutKeyRef.current === activeLayoutKey) {
      return;
    }

    lastLoadedLayoutKeyRef.current = activeLayoutKey;
    planner.loadState(activeSnapshot.state, activeLayoutKey);
    setCanvasLayoutKey(activeLayoutKey);
  }, [activeLayoutKey, activeSnapshot.state, planner.loadState]);

  useEffect(() => {
    if (canvasLayoutKey !== activeLayoutKey) {
      return;
    }

    updateSnapshotState(activeProject.id, activeSnapshot.id, planner.state);
  }, [
    activeLayoutKey,
    activeProject.id,
    activeSnapshot.id,
    canvasLayoutKey,
    planner.state,
    updateSnapshotState,
  ]);

  return (
    <>
      <Canvas key={canvasLayoutKey} planner={planner} />
      <Sidebar planner={planner} projects={projects} />
    </>
  );
}

function AppContent() {
  const projects = usePlannerProjects();
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        'relative h-screen w-screen overflow-hidden transition-colors duration-300',
        theme === 'dark'
          ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950'
          : 'bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50',
      )}
    >
      <PlannerWorkspace projects={projects} />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
