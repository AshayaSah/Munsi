import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/context/AuthContext";

const API_BASE_URL = "http://localhost:8000";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const { loginWithToken } = useAuth();
  const [token, setToken] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleFacebookLogin = (): void => {
    window.location.href = `${API_BASE_URL}/auth/facebook/login`;
  };

  const handleTokenLogin = (e: React.FormEvent): void => {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError("Please enter a valid access token.");
      return;
    }
    setError("");
    loginWithToken(trimmed);
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* ── Form ── */}
          <form className="p-6 md:p-8" onSubmit={handleTokenLogin}>
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col items-center gap-2 text-center">
                <h1 className="text-2xl font-bold">Messenger Agent</h1>
                <p className="text-muted-foreground text-balance text-sm">
                  Connect your Facebook account to continue
                </p>
              </div>

              {/* Facebook OAuth */}
              <Button
                type="button"
                className="w-full"
                onClick={handleFacebookLogin}
              >
                {/* Facebook icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="mr-2 h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
                </svg>
                Login with Facebook
              </Button>

              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted-foreground text-xs">
                  or use access token
                </span>
                <Separator className="flex-1" />
              </div>

              {/* Manual token */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="token">Access Token</Label>
                <Input
                  id="token"
                  type="password"
                  placeholder="Paste your Facebook access token"
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    setError("");
                  }}
                />
              </div>

              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={!token.trim()}
              >
                Continue with Token
              </Button>

              {/* Setup note */}
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Setup required</p>
                <p>pip install fastapi uvicorn httpx</p>
                <p>Set FB_APP_ID and FB_APP_SECRET</p>
                <p>python backend.py</p>
              </div>
            </div>
          </form>

          {/* ── Side image ── */}
          <div className="bg-muted relative hidden md:block">
            <img
              src="/login/login2.png"
              alt="Messenger Agent"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-muted-foreground px-6 text-center text-xs">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4 hover:text-primary">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
