import { AuthForm } from "../auth-form";

export default function ParticipantsRegisterPage() {
  return (
    <AuthForm
      appName="PollaVAR Participantes"
      mode="register"
      alternateHref="/login"
      alternateLabel="Iniciar sesión"
    />
  );
}
