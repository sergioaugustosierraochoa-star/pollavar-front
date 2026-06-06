import { AuthForm } from "../auth-form";

export default function ParticipantsLoginPage() {
  return (
    <AuthForm
      appName="PollaVAR Participantes"
      mode="login"
      alternateHref="/register"
      alternateLabel="Crear cuenta"
    />
  );
}
