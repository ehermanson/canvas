# Refactor Plan: shadcn Components

## 1. Custom Tabs → shadcn Tabs

**Current**: Manual `activeTab` state + button elements + conditional rendering
**Target**: `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from shadcn

Changes in `sidebar.tsx`:
- Remove `activeTab` state and `setActiveTab`
- Remove `TabType` type
- Import shadcn Tabs components
- Replace button-based tabs with `TabsList` + `TabsTrigger`
- Replace conditional `{activeTab === 'x' && ...}` with `TabsContent`
- Style `TabsList` to match current design (full-width, border-bottom)
- Style `TabsTrigger` to match current styling (icons, colors)

## 2. Labels/Inputs → Field Components

**Current pattern**:
```tsx
<div className="space-y-1.5">
  <Label>Name</Label>
  <Input ... />
</div>
```

**With description**:
```tsx
<div className="space-y-1.5">
  <Label>Name</Label>
  <span className="text-xs text-gray-500">Helper text</span>
  <Input ... />
</div>
```

**Target pattern**:
```tsx
<Field>
  <FieldLabel>Name</FieldLabel>
  <Input ... />
</Field>

<Field>
  <FieldLabel>Name</FieldLabel>
  <FieldDescription>Helper text</FieldDescription>
  <Input ... />
</Field>
```

Files to update:
- `wall-dimensions.tsx` - 2 fields
- `layout-type-selector.tsx` - 1 field (frame count input)
- `frame-size.tsx` - ~5 fields (size select, width/height, hook offset, hook inset)
- `vertical-position.tsx` - ~5 fields (anchor value, furniture dims, gap)
- `horizontal-position.tsx` - ~3 fields (anchor value, gap)

## Unresolved Questions

None - both shadcn components already installed, patterns are straightforward.
