import { LogOut } from 'lucide-react'

export default function SignOutButton({ label, onLoginOut }) {
  return (
    <button className="sign-out" type="button" onClick={onLoginOut}>
      <LogOut className="sign-out-icon" aria-hidden="true" strokeWidth={1.8} />
      <span>{label}</span>
    </button>
  )
}
