import AuthLayout from '../components/AuthLayout'
import AuthForm from '../components/AuthForm'

export default function Login() {
  return (
    <AuthLayout>
      <AuthForm mode="login" />
    </AuthLayout>
  )
}
