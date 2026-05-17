import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Beaker, BookOpen, MessagesSquare, Microscope, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/portal" />;

  return (
    <div className="min-h-screen bg-background bg-lab-grid">
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Microscope className="h-5 w-5" />
            </div>
            <div className="font-display text-lg font-semibold tracking-tight">
              Mr. Fidelis's Lecture Hub
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
            <Link to="/signup"><Button>Create account</Button></Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Beaker className="h-3.5 w-3.5" />
              For medical laboratory students
            </div>
            <h1 className="font-display text-5xl font-semibold leading-tight md:text-6xl">
              Lecture notes,<br />
              <span className="text-primary">examined together.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-muted-foreground">
              A focused space where Mr. Fidelis shares lecture material and students
              react, comment, and discuss — turning notes into understanding.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup"><Button size="lg">Get started</Button></Link>
              <Link to="/admin">
                <Button size="lg" variant="outline">
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Lecturer login
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <FeatureCard
              icon={<BookOpen className="h-5 w-5" />}
              title="Curated lecture notes"
              body="Organized by topic, posted by the lecturer, always accessible."
            />
            <FeatureCard
              icon={<MessagesSquare className="h-5 w-5" />}
              title="React & discuss"
              body="Four reactions, threaded comments, and student-led discussion topics."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Engagement tracking"
              body="The lecturer sees who's participating — names, matric numbers, and activity."
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Built for the Department of Medical Laboratory Science
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="mt-1 text-sm text-muted-foreground">{body}</div>
        </div>
      </div>
    </div>
  );
}
