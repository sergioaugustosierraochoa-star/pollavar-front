import { AuthForm } from "../auth-form";

export default function AdminRegisterPage() {
  return (
    <AuthForm
      appName="PollaVAR Admin"
      mode="register"
      storageKey="pollavar.admin.session"
      alternateHref="/login"
      alternateLabel="Iniciar sesion"
    />
  );
}
