import { ChefHat, Home, Settings, Users } from 'lucide-react'

const menuItems = [
  { key: 'main', icon: Home, itemNumber: 0 },
  { key: 'recipes', icon: ChefHat, itemNumber: 1 },
  { key: 'users', icon: Users, itemNumber: 2 },
  { key: 'settings', icon: Settings, itemNumber: 3 },
]

export default function NavigationMenu({ label, activeItem, onSelect, labels }) {
  return (
    <>
      <div className="menu-heading">{label}</div>
      <nav className="menu-list" aria-label={label}>
        {menuItems.map((item) => (
          <button
            className={`menu-item ${activeItem === item.key ? 'is-active' : ''}`}
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key, item.itemNumber)}
          >
            <item.icon className="menu-icon" aria-hidden="true" strokeWidth={1.8} />
            <span>{labels[item.key]}</span>
            {activeItem === item.key && <span className="active-indicator" aria-hidden="true" />}
          </button>
        ))}
      </nav>
    </>
  )
}
