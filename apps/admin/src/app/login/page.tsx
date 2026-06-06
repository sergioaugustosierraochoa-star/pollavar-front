import { AuthForm } from "../auth-form";

export default function AdminLoginPage() {
  return (
    <AuthForm
      appName="PollaVAR Admin"
      mode="login"
      alternateHref="/register"
      alternateLabel="Crear cuenta"
    />
  );
}
