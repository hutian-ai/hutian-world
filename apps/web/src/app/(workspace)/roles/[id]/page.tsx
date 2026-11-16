import { redirect } from "@/lib/navigation";

export default async function RolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/members/${encodeURIComponent(id)}`);
}
