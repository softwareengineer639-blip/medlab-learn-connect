import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Microscope } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: Signup,
});

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  matric_number: z.string().trim().min(3, "Matric number required").max(40),
  email: z.string().trim().email("Valid email required").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name: "", matric_number: "", email: "", password: "" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/portal`,
        data: {
          full_name: parsed.data.full_name,
          matric_number: parsed.data.matric_number,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created. Welcome!");
    navigate({ to: "/portal" });
  }

  return (
    <AuthShell title="Join the Hub" subtitle="Create your student account">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field id="full_name" label="Full name">
          <Input id="full_name" value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
        </Field>
        <Field id="matric_number" label="Matric number">
          <Input id="matric_number" value={form.matric_number}
            onChange={(e) => setForm({ ...form, matric_number: e.target.value })} required />
        </Field>
        <Field id="email" label="Email">
          <Input id="email" type="email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field id="password" label="Password">
          <Input id="password" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Already registered? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background bg-lab-grid">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-12">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Microscope className="h-5 w-5" />
          </div>
          <div className="font-display text-lg font-semibold">Lecture Hub</div>
        </Link>
        <div className="glass-card w-full rounded-2xl p-7">
          <h1 className="font-display text-2xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
