import { AuthForm } from "../auth-form";

export default function ParticipantsRegisterPage() {
  return (
    <AuthForm
      appName="PollaVAR Participantes"
      mode="register"
      storageKey="pollavar.participants.session"
      alternateHref="/login"
      alternateLabel="Iniciar sesion"
    />
  );
}
