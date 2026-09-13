export default function NavigationBrand({ label }) {
  return (
    <div className="brand-block">
      <div className="brand-mark" aria-hidden="true">
        <span>N</span>
        <i />
      </div>
      <span className="brand-name">{label}</span>
    </div>
  )
}
