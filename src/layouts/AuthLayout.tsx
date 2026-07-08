import { Outlet } from 'react-router';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
