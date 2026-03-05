import express from "express";

interface Note {
  id: number;
  title: string;
  done: boolean;
}

const app = express();
const notes: Note[] = [
  { id: 1, title: "Ship hello endpoint", done: true },
  { id: 2, title: "Add note CRUD", done: false }
];

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Hello from Task Notes API" });
});

app.get("/notes", (_req, res) => {
  res.json(notes);
});

app.post("/notes", (req, res) => {
  const title = String(req.body?.title ?? "").trim();
  if (!title) {
    res.status(422).json({ error: "title is required" });
    return;
  }

  const created: Note = {
    id: notes.length === 0 ? 1 : Math.max(...notes.map((item) => item.id)) + 1,
    title,
    done: Boolean(req.body?.done)
  };

  notes.push(created);
  res.status(201).json(created);
});

app.put("/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  const note = notes.find((item) => item.id === id);

  if (!note) {
    res.status(404).json({ error: "note not found" });
    return;
  }

  const title = String(req.body?.title ?? note.title).trim();
  if (!title) {
    res.status(422).json({ error: "title is required" });
    return;
  }

  note.title = title;
  note.done = req.body?.done === undefined ? note.done : Boolean(req.body.done);
  res.json(note);
});

app.delete("/notes/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = notes.findIndex((item) => item.id === id);

  if (index === -1) {
    res.status(404).json({ error: "note not found" });
    return;
  }

  notes.splice(index, 1);
  res.status(204).send();
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Task Notes API listening on http://localhost:${port}`);
});
