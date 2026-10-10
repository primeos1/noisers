import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";

export default function NotFound() {
  return (
    <Layout>
      <PageHeader eyebrow="404" title="Page not found" />
      <section className="bg-ink">
        <div className="mx-auto max-w-7xl px-5 py-10 md:px-10 md:py-16">
          <p className="text-sm text-paper-dim">
            That page doesn't exist.{" "}
            <Link to="/" className="text-paper underline underline-offset-4">
              Back to the home page
            </Link>
          </p>
        </div>
      </section>
    </Layout>
  );
}
