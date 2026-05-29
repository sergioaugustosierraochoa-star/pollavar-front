import { AuthForm } from "../auth-form";

export default function AdminLoginPage() {
  return (
    <AuthForm
      appName="PollaVAR Admin"
      mode="login"
      storageKey="pollavar.admin.session"
      alternateHref="/register"
      alternateLabel="Crear cuenta"
    />
  );
}
