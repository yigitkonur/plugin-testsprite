export default async function Page() {
  const now = new Date().toISOString(); // rendered on the server per request
  return <main>Rendered at {now}</main>;
}
