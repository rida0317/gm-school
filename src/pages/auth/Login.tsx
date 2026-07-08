import { LoginForm } from "@/features/auth/components/LoginForm";

export default function Login() {
  return (
    <div className="flex flex-col space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>
      
      <LoginForm />
    </div>
  );
}
