import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { SearchableSelect } from './SearchableSelect'
import './RecipeComponents.css'

const labels = {
  en: {
    heading: 'Recipe Components',
    add: 'Add Component',
    index: '#', material: 'Material Name', materialCode: 'Material Code',
    quantity: 'Target Quantity', unit: 'Unit', actions: 'Actions',
    materialPlaceholder: 'Select material',
    codePlaceholder: 'Select code',
    remove: 'Remove component',
    totalMaterials: 'Total Materials', totalQuantity: 'Total Quantity',
    empty: 'No components yet. Add one to begin.',
  },
  ar: {
    heading: 'مكونات الوصفة',
    add: 'إضافة مكوّن',
    index: '#', material: 'اسم المادة', materialCode: 'رمز المادة',
    quantity: 'الكمية المستهدفة', unit: 'الوحدة', actions: 'إجراءات',
    materialPlaceholder: 'اختر المادة',
    codePlaceholder: 'اختر الرمز',
    remove: 'حذف المكوّن',
    totalMaterials: 'إجمالي المواد', totalQuantity: 'إجمالي الكمية',
    empty: 'لا توجد مكونات بعد. أضف واحدًا للبدء.',
  },
}


/**
 * Normalize whatever the container sent into the shape above.
 *
 * recipe_material carries one `name` column rather than a name per language,
 * so a supplied row's name is used for both - translating plant material names
 * is the database's call, not something to invent here. A name that already
 * arrives as an {en, ar} pair is passed through, so a future bilingual source
 * needs no change here.
 *
 * Rows without a usable code are dropped: the code is the row's identity, and
 * an entry that cannot be stored would be a dropdown option that does nothing.
 *
 * Empty until LoadAvailableMaterials has been called: offering a built-in list
 * meant offering codes the database had never heard of, and a component naming
 * one was dropped by the insert's join without an error.
 */
const normalizeMaterials = (supplied) => {
  if (!Array.isArray(supplied) || supplied.length === 0) return []
  const normalized = []
  for (const entry of supplied) {
    if (!entry || typeof entry !== 'object') continue
    const code = String(entry.code ?? entry.Code ?? '').trim()
    if (!code) continue
    const rawName = entry.name ?? entry.Name
    // Already bilingual, or a plain column value to be used for both.
    const name = rawName && typeof rawName === 'object'
      ? rawName
      : { en: String(rawName ?? code), ar: String(rawName ?? code) }
    // The material's unit of measure, carried through so the row can show it.
    // Empty when the source did not select the column, which the table renders
    // as an em dash rather than inventing kg.
    const unit = String(entry.unit ?? entry.Unit ?? entry.uom ?? entry.UOM ?? '').trim()
    normalized.push({ code, name, unit })
  }
  return normalized
}

// The code is the stable identity; the displayed name is derived from it. A row
// therefore keeps its material across a language switch and simply re-labels,
// where storing the name would strand an English string in an Arabic table.
const nameFor = (materials, code, language) => {
  const material = materials.find((entry) => entry.code === code)
  if (!material) return ''
  return material.name[language] ?? material.name.en
}
const codeForName = (materials, name, language) =>
  materials.find((entry) => (entry.name[language] ?? entry.name.en) === name)?.code ?? ''

// Read-only, and deliberately not stored on the row: the unit belongs to the
// material, so holding a copy per component would let the two disagree once the
// catalogue is reloaded. Derived on render instead, the way the name is.
const unitFor = (materials, code) =>
  materials.find((entry) => entry.code === code)?.unit ?? ''

export const emptyComponent = () => ({
  // Local identity only - the database assigns the real key on save. Needed so
  // React can track rows across insert and delete without keying on the index,
  // which would reorder inputs when a middle row is removed.
  key: `c${Math.random().toString(36).slice(2, 10)}`,
  // The chosen material, held as its code. The name shown in the table is
  // looked up from this, so it follows the active language.
  material_code: '',
  quantity: '',
})

/**
 * Components step of the new-recipe form.
 *
 * Rows are controlled by the parent, which owns the draft: this renders them
 * and reports edits, so leaving the step and returning does not lose anything.
 *
 * Material is a fixed vocabulary rather than free text, so a recipe cannot
 * name a material the plant does not stock - the same reason Unit is a select.
 */
export function RecipeComponents({ language = 'en', materials = null, rows, onChange }) {
  const text = labels[language] ?? labels.en
  // The container's catalogue, empty until LoadAvailableMaterials has been
  // called. Memoized so the two dropdowns are not handed a fresh array on
  // every keystroke in the quantity field.
  const catalogue = useMemo(() => normalizeMaterials(materials), [materials])
  // Option labels in the active language, and the matcher that lets a material
  // be found by its code as well as by that label.
  const materialNames = catalogue.map((material) => material.name[language] ?? material.name.en)
  const materialSearchText = (name) => `${name} ${codeForName(catalogue, name, language)}`
  // The mirror of materialSearchText: a code is findable by its material's
  // name, so either column can be searched the same two ways.
  const codeSearchText = (code) => `${code} ${nameFor(catalogue, code, language)}`
  const materialCodes = catalogue.map((entry) => entry.code)

  // Merges a patch into one row, so fields that must change together can do so
  // in a single pass over the array.
  const setRow = (key, patch) => {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  // Takes the value directly, for controls that report one rather than an
  // event - the material combobox is not a DOM input.
  const setField = (key, field, value) => setRow(key, { [field]: value })

  const updateRow = (key, field) => (event) => setField(key, field, event.target.value)

  const addRow = () => onChange([...rows, emptyComponent()])
  const removeRow = (key) => onChange(rows.filter((row) => row.key !== key))

  // Blank and non-numeric entries contribute nothing rather than poisoning the
  // sum with NaN, so the total stays readable while a row is still being typed.
  //
  // Rounded because adding decimals gives values like 2349.9999999999995,
  // which reads as noise rather than as a quantity.
  const totalQuantity = Math.round(rows.reduce((sum, row) => {
    const value = Number(row.quantity)
    return Number.isFinite(value) ? sum + value : sum
  }, 0) * 1000) / 1000

  return (
    <div className="components">
      <div className="components__top">
        <h3 className="components__heading">{text.heading}</h3>
        <button className="components__add" type="button" onClick={addRow}>
          <Plus size="1em" aria-hidden="true" /> {text.add}
        </button>
      </div>

      <div className="components__scroll">
        <table className="components__table">
          <thead>
            <tr>
              <th className="components__col-index" scope="col">{text.index}</th>
              {/* Classed so the width is declared on the header too: the body
                  cells alone left the two columns sized by their contents. */}
              <th className="components__col-material" scope="col">{text.material}</th>
              <th className="components__col-code" scope="col">{text.materialCode}</th>
              <th className="components__col-qty" scope="col">{text.quantity}</th>
              <th className="components__col-unit" scope="col">{text.unit}</th>
              <th className="components__col-actions" scope="col">{text.actions}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td className="components__empty" colSpan={6}>{text.empty}</td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={row.key}>
                <td className="components__col-index">{index + 1}</td>
                <td className="components__col-material">
                  {/* A row starts unset, and an unset row is dropped on submit
                      rather than saved as a material. */}
                  <SearchableSelect
                    value={nameFor(catalogue, row.material_code, language)}
                    options={materialNames}
                    searchText={materialSearchText}
                    language={language}
                    placeholder={text.materialPlaceholder}
                    ariaLabel={`${text.material} ${index + 1}`}
                    // Stored as the code, so the row keeps its material when
                    // the language changes and simply re-labels.
                    onChange={(name) => setField(row.key, 'material_code', codeForName(catalogue, name, language))}
                  />
                </td>
                <td className="components__col-code">
                  {/* The same material_code the name column edits, so picking
                      here relabels that cell and picking there relabels this
                      one. dir stays LTR: codes are an ASCII identifier in
                      every row the list renders. */}
                  <div dir="ltr">
                    <SearchableSelect
                      value={row.material_code}
                      options={materialCodes}
                      searchText={codeSearchText}
                      language={language}
                      placeholder={text.codePlaceholder}
                      ariaLabel={`${text.materialCode} ${index + 1}`}
                      onChange={(code) => setField(row.key, 'material_code', code)}
                    />
                  </div>
                </td>
                <td className="components__col-qty">
                  <input
                    className="components__input components__input--number"
                    type="number"
                    min="0"
                    step="any"
                    value={row.quantity}
                    onChange={updateRow(row.key, 'quantity')}
                    dir="ltr"
                    aria-label={`${text.quantity} ${index + 1}`}
                  />
                </td>
                <td className="components__col-unit">
                  {/* Read-only: it is the material's own unit, so it follows
                      the chosen material rather than being picked per row. */}
                  {unitFor(catalogue, row.material_code)
                    ? <span dir="ltr">{unitFor(catalogue, row.material_code)}</span>
                    : <span className="components__unset">—</span>}
                </td>
                <td className="components__col-actions">
                  <button
                    className="components__remove"
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`${text.remove} ${index + 1}`}
                    title={text.remove}
                  >
                    <Trash2 size="1em" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="components__totals">
        <span>{text.totalMaterials}: <strong>{rows.length}</strong></span>
        <span>{text.totalQuantity}: <strong dir="ltr">{totalQuantity}</strong></span>
      </div>
    </div>
  )
}
