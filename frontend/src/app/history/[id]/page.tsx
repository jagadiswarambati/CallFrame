import type { Metadata } from "next";
import CallDetail from "./CallDetail";

export const metadata: Metadata = { title: "Call detail" };

export default function CallDetailPage() {
  return <CallDetail />;
}
