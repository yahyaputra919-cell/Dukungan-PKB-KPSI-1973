import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public-page";

export const Route = createFileRoute("/")({ component: PublicPage });
