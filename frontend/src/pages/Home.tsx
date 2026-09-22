import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import StatsBand from "../components/StatsBand";
import StorySection from "../components/StorySection";
import AtmosphereBreak from "../components/AtmosphereBreak";
import SquadPreview from "../components/SquadPreview";
import MatchdaySection from "../components/MatchdaySection";
import Gallery from "../components/Gallery";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-ink">
      <Navbar />
      <main>
        <Hero />
        <StatsBand />
        <StorySection />
        <AtmosphereBreak />
        <SquadPreview />
        <MatchdaySection />
        <Gallery />
      </main>
      <Footer />
    </div>
  );
}
