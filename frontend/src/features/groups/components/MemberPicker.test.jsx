
import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemberPicker } from "./MemberPicker";

const contacts = [
    { user_id: "user-01", name: "Maria Oliveira", email: "maria@empresa.com", status: "ACTIVE" },
    { user_id: "user-02", name: "Rafael Santos", email: "rafael@empresa.com", status: "ACTIVE" },
    { user_id: "user-03", name: "Usuario Inativo", email: "inativo@empresa.com", status: "INACTIVE" },
];

afterEach(cleanup);

test("deve listar apenas contatos ativos", () => {
    render(<MemberPicker contacts={contacts} onChange={vi.fn()} />);
    expect(screen.getByText("Maria Oliveira")).toBeInTheDocument();
    expect(screen.getByText("Rafael Santos")).toBeInTheDocument();
    expect(screen.queryByText("Usuario Inativo")).not.toBeInTheDocument();
});

test("deve selecionar um participante", () => {
    const onChange = vi.fn();
    render(<MemberPicker contacts={contacts} selectedIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Maria Oliveira" }));
    expect(onChange).toHaveBeenCalledWith(["user-01"]);
});

test("deve permitir remover uma seleção", () => {
    const onChange = vi.fn();
    render(<MemberPicker contacts={contacts} selectedIds={["user-01"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Maria Oliveira" }));
    expect(onChange).toHaveBeenCalledWith([]);
});

test("deve impedir seleção acima do limite", () => {
    render(<MemberPicker contacts={contacts} selectedIds={["user-01"]} maxSelectable={1} onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Selecionar Rafael Santos" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Selecionar Maria Oliveira" })).not.toBeDisabled();
});

test("deve filtrar participantes pelo nome", () => {
    render(<MemberPicker contacts={contacts} onChange={vi.fn()} />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar participantes" }), { target: { value: "maria" } });
    expect(screen.getByText("Maria Oliveira")).toBeInTheDocument();
    expect(screen.queryByText("Rafael Santos")).not.toBeInTheDocument();
});

test("deve apresentar estado vazio", () => {
    render(<MemberPicker contacts={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Nenhum contato disponível.");
});

test("deve impedir alterações durante o envio", () => {
    render(<MemberPicker contacts={contacts} disabled onChange={vi.fn()} />);
    expect(screen.getByRole("checkbox", { name: "Selecionar Maria Oliveira" })).toBeDisabled();
    expect(screen.getByRole("searchbox", { name: "Buscar participantes" })).toBeDisabled();
});
