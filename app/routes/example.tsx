import type { Route } from "./+types/example";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Example Page" },
    { name: "description", content: "Welcome to the example page." },
  ];
}

export default function Example() {
  return <main></main>;
}
