import HeroCarousel from "@/components/HeroCarousel";
import PosterRail from "@/components/PosterRail";
import TopOverlayNav from "@/components/TopOverlayNav";
import { WATCHLIST, RECENTLY_WATCHED } from "@/lib/mock";

/**
 * Home page (watchlist + recently watched). Shown after login at /home.
 *
 * Change these to customize:
 * - Titles and subtitles: edit the title/subtitle props on each PosterRail.
 * - Data source: swap WATCHLIST / RECENTLY_WATCHED for your own arrays or API data (see @/lib/mock for shape).
 * - Hero: HeroCarousel uses WATCHLIST; pass a different list if you want a different hero set.
 * - showRating: set to true on a PosterRail to show ratings on each card.
 */
export default function Home() {
  return (
    <main className="bg-black text-white">
      <TopOverlayNav />
      {/* Hero uses same list as watchlist by default; change movies={...} to use a different set. */}
      <HeroCarousel movies={WATCHLIST} />
      <div className="h-10 bg-black" />

      <div className="pb-32">
        {/* "Recently watched" rail: change title/subtitle for copy; movies= controls the list. */}
        <PosterRail
          title="The Films I have watched"
          subtitle="Watched any new movies lately? Add them here!"
          movies={RECENTLY_WATCHED}
          showRating
        />
        {/* Watchlist rail: change title/subtitle; movies= is the watchlist data. */}
        <PosterRail
          title="Any Movies You Wanna Watch?"
          subtitle="Add to your watchlist? Check it out!"
          movies={WATCHLIST}
        />
      </div>
    </main>
  );
}

