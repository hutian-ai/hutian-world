import { ProjectDirectory } from "@/components/directories";
import { getWorkspace } from "@/lib/api";

export default async function ProjectsPage() {
  return <ProjectDirectory workspace={await getWorkspace()} />;
}
