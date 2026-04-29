import { Table } from "../../ui/Table.tsx";

type UserRow = { username: string; uid: number; shell: string; home: string };

export function UserList({ rows }: { rows: UserRow[] }) {
  return (
    <Table
      rows={rows}
      getKey={(row) => row.username}
      columns={[
        { key: "username", header: "Username", render: (row) => row.username },
        { key: "uid", header: "UID", render: (row) => row.uid },
        { key: "home", header: "Home", render: (row) => row.home },
        { key: "shell", header: "Shell", render: (row) => row.shell }
      ]}
    />
  );
}
