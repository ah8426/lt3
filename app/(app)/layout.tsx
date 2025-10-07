export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      {/* Navigation will go here */}
      <main className="container mx-auto p-6">
        {children}
      </main>
    </div>
  )
}
