import Layout from "../components/Layout";
import Hero from "../components/Hero";
import StatsBand from "../components/StatsBand";
import StorySection from "../components/StorySection";
import AtmosphereBreak from "../components/AtmosphereBreak";
import SquadPreview from "../components/SquadPreview";
import MatchdaySection from "../components/MatchdaySection";
import Gallery from "../components/Gallery";

export default function Home() {
  return (
    <Layout>
      <Hero />
      <StatsBand />
      <StorySection />
      <AtmosphereBreak />
      <SquadPreview />
      <MatchdaySection />
      <Gallery />
    </Layout>
  );
}
