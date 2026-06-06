import { AuthForm } from "../auth-form";

export default function AdminRegisterPage() {
  return (
    <AuthForm
      appName="PollaVAR Admin"
      mode="register"
      alternateHref="/login"
      alternateLabel="Iniciar sesion"
    />
  );
}
