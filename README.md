# vidojo

Learn vi by actually using it.

vidojo drops you into a simulated Linux box with a real C++ raytracer sitting in
it. You `cd` around, you `ls`, you open files with `vi`, and you edit them with
the same keys you would use at work. Nothing here touches your machine.

Live at **[vidojo.vercel.app](https://vidojo.vercel.app)**.

## Two modes

**Learn** walks you through twenty two lessons, from the difference between
normal and insert mode up through operators, counts and text objects. Each
lesson has checkpoints that tick themselves off when you do the thing. Nothing
is blocked: you can type any command at any time, and the checkpoint is still
waiting when you come back.

**Sandbox** is the same box with the goals turned off. The raytracer project is
all there, so you can practise on code that has real brackets, real quotes and
real indentation.

## What the editor supports

Modes: normal, insert, replace, visual, visual line, visual block, command line.

Motions: `h j k l`, `w W b B e E`, `0 ^ $ g_`, `gg G`, `{ }`, `f F t T` with
`;` and `,`, `%`, `H M L`, `/` and `?` with `n` and `N`, marks with `m` and `'`.

Operators: `d c y`, `>` and `<`, `gu gU g~`, each taking a motion, a count or a
text object. Counts multiply on both sides, so `2d3w` deletes six words.

Text objects: `iw aw iW aW`, quotes, every bracket pair, and `ip ap`.

Edits: `x X s S D C Y p P J r R ~`, `o O a A i I`, undo with `u`, redo with
`ctrl r`, and `.` to repeat the last change.

Ex commands: `:w :q :wq :x :q!`, `:set` for numbers and search options, `:noh`,
a bare line number to jump, and `:s` with `%` and the `g` flag.

## What the shell supports

`ls cd pwd cat head tail wc grep find tree mkdir rmdir touch rm cp mv echo file
vi make which man history env clear help`, plus tab completion over commands and
paths, command history on the arrow keys, and a `make` that pretends to compile
the project.

## On a phone

vidojo checks whether you are on a phone or a laptop. On a phone it raises the
real keyboard through a hidden capture field, so every character you type works,
and adds a key bar above it for `Esc`, `:`, `/`, the arrows and the vi keys that
are awkward to reach. The bar changes with the mode you are in.

## Running it

```
npm install
npm run dev
```

Then open http://localhost:3000.

## How it is put together

```
src/lib/fs        the virtual filesystem and the C++ project inside it
src/lib/shell     command parsing, the command set, tab completion
src/lib/vi        the editor: motions, text objects, operators, ex commands
src/lib/lessons   the lesson track and its checkpoints
src/hooks         session state, lesson progress, theme, device
src/components    the terminal, the two views, the lesson panel, the key bar
```

The vi engine is a pure function. `handleKey(state, key)` takes an editor state
and one keystroke and returns the next state, which is what makes the dot
command work: it replays the keys of the last change through the same function.

Built with Next.js, TypeScript and Tailwind.
