import { AuthForm } from "../auth-form";

export default function ParticipantsLoginPage() {
  return (
    <AuthForm
      appName="PollaVAR Participantes"
      mode="login"
      storageKey="pollavar.participants.session"
      alternateHref="/register"
      alternateLabel="Crear cuenta"
    />
  );
}
