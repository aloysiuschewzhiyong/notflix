import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/header";
import Footer from "@/components/footer";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { getMovieGenres, getTVGenres, getMediaList } from "@/utils/tmdb";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Notflix",
  description: "Arr pirate movies and tv",
};

// Header data is non-critical: fall back to empty lists if TMDB is unreachable
async function getHeaderData() {
  const safe = <T,>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
  const [movieGenres, tvGenres, trending] = await Promise.all([
    safe(getMovieGenres(), []),
    safe(getTVGenres(), []),
    getMediaList("/trending/all/day"),
  ]);
  return { movieGenres, tvGenres, trending: trending.slice(0, 6) };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerData = await getHeaderData();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header {...headerData} />
          <main className="flex-grow">{children}</main>
          <Analytics />
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
