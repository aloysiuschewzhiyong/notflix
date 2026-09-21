import { redirect } from "next/navigation";

interface SeasonPageProps {
  params: Promise<{
    id: string;
    seasonNumber: string;
  }>;
}

// Seasons are browsed inline on the show page now; keep old links working
export default async function SeasonPage({ params }: SeasonPageProps) {
  const { id, seasonNumber } = await params;
  redirect(`/tv/${id}?season=${seasonNumber}#episodes`);
}
