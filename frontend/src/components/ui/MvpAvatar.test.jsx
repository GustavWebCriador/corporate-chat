import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MvpAvatar } from "./MvpAvatar";

afterEach(cleanup);

test("FE-09: mostra as iniciais no avatar da interface original", () => {
    render(<MvpAvatar name="Ana Ferreira" />);
    expect(screen.getByText("AF")).toBeInTheDocument();
});

test("FE-09: suporta nome ausente sem expor identificadores", () => {
    render(<MvpAvatar name="" />);
    expect(screen.getByText("U")).toBeInTheDocument();
});