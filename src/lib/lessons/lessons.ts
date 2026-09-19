import { HOME } from "@/lib/fs/types";
import type { Lesson, Probe } from "./types";
import { savedText, text, wordAt } from "./types";

const DOJO = `${HOME}/dojo`;

function charAt(probe: Probe): string {
  return (probe.lines[probe.cursor.line] ?? "")[probe.cursor.col] ?? "";
}

function lineText(probe: Probe): string {
  return probe.lines[probe.cursor.line] ?? "";
}

function typed(probe: Probe, key: string): boolean {
  return probe.keys.includes(key);
}

export const LESSONS: Lesson[] = [
  {
    id: "box",
    title: "The box",
    blurb:
      "Before vi, the shell. This is a small Linux userspace with a C++ raytracer living in it. Everything you break here is pretend.",
    shell: true,
    checkpoints: [
      {
        goal: "List what is in your home directory",
        keys: ["ls"],
        hint: "Type ls and press Enter. Add the flag -la to see hidden files too.",
        done: (p) => p.commands.some((c) => c.split(" ")[0] === "ls"),
      },
      {
        goal: "Walk into the raytracer source folder",
        keys: ["cd"],
        hint: "cd raytracer then cd src, or go straight there with cd raytracer/src.",
        done: (p) => p.cwd.endsWith("/raytracer/src"),
      },
      {
        goal: "Open render.cpp in the editor",
        keys: ["vi"],
        hint: "vi render.cpp",
        done: (p) => p.screen === "editor" && p.name === "render.cpp",
      },
      {
        goal: "Leave the editor again",
        keys: [":q"],
        hint: "Type a colon, then q, then Enter. You changed nothing, so vi lets you go.",
        done: (p) => p.screen === "shell",
      },
    ],
  },

  {
    id: "modes",
    title: "Normal and insert",
    blurb:
      "vi starts in normal mode, where letters are commands. Insert mode is the only place your typing becomes text. You visit it, you do not live there.",
    file: {
      path: `${DOJO}/hello.cpp`,
      lines: [
        "#include <iostream>",
        "",
        "int main() {",
        "  std::cout << \"\";",
        "  return 0;",
        "}",
      ],
    },
    checkpoints: [
      {
        goal: "Enter insert mode",
        keys: ["i"],
        hint: "Press i. Watch the status line say INSERT.",
        done: (p) => p.mode === "insert",
      },
      {
        goal: "Type anything at all",
        keys: ["a to z"],
        hint: "Any letters will do. The file is yours.",
        done: (p) => p.mode === "insert" && text(p) !== p.saved.join("\n"),
      },
      {
        goal: "Get back to normal mode",
        keys: ["Esc"],
        hint: "Press Escape. When in doubt, press it twice.",
        done: (p) => p.mode === "normal" && text(p) !== savedText(p),
      },
    ],
  },

  {
    id: "hjkl",
    title: "Moving with hjkl",
    blurb:
      "h and l sit under your index fingers and move left and right. j hangs down like a hook, k points up. Your hands never leave home row.",
    file: {
      path: `${DOJO}/grid.txt`,
      lines: [
        "start here",
        "..........",
        "..........",
        "..........",
        "....X.....",
        "..........",
      ],
    },
    checkpoints: [
      {
        goal: "Move down to the row holding the X",
        keys: ["j"],
        hint: "Press j four times. Counts work too: 4j.",
        done: (p) => p.cursor.line === 4,
      },
      {
        goal: "Park the cursor right on the X",
        keys: ["l", "h"],
        hint: "The X is the fifth character. Press l until you are on it.",
        done: (p) => charAt(p) === "X",
      },
    ],
  },

  {
    id: "words",
    title: "Moving by word",
    blurb:
      "Character at a time is slow. w jumps to the start of the next word, b jumps back, e lands on the end of the current one.",
    file: {
      path: `${DOJO}/words.cpp`,
      lines: [
        "Vec3 normalize(const Vec3 &v) {",
        "  double len = v.length();",
        "  return v * (1.0 / len);",
        "}",
      ],
    },
    checkpoints: [
      {
        goal: "Jump forward to the word normalize",
        keys: ["w"],
        hint: "One press of w from the start of the line.",
        done: (p) => p.cursor.line === 0 && wordAt(p) === "normalize",
      },
      {
        goal: "Land on the final character of a word",
        keys: ["e"],
        hint: "e means end. From inside a word it goes to that word's last letter.",
        done: (p) => typed(p, "e") && /[A-Za-z0-9_]/.test(charAt(p)) &&
          !/[A-Za-z0-9_]/.test((p.lines[p.cursor.line] ?? "")[p.cursor.col + 1] ?? ""),
      },
      {
        goal: "Walk back a word with b",
        keys: ["b"],
        hint: "b is the mirror of w.",
        done: (p) => typed(p, "b") && p.cursor.col > 0,
      },
    ],
  },

  {
    id: "lineends",
    title: "The ends of a line",
    blurb:
      "0 goes to column one, always. ^ goes to the first thing that is not whitespace, which is usually what you meant. $ goes to the end.",
    file: {
      path: `${DOJO}/indent.cpp`,
      lines: [
        "    double half_b = dot(oc, ray.direction());",
        "    double c = oc.length_squared() - radius * radius;",
        "",
      ],
    },
    checkpoints: [
      {
        goal: "Go to the very end of the first line",
        keys: ["$"],
        hint: "Shift and 4.",
        done: (p) => p.cursor.line === 0 && p.cursor.col === lineText(p).length - 1,
      },
      {
        goal: "Snap back to column one",
        keys: ["0"],
        hint: "Zero, not the letter O. You land on the indent whitespace.",
        done: (p) => p.cursor.col === 0 && typed(p, "0"),
      },
      {
        goal: "Move to the first real character",
        keys: ["^"],
        hint: "Shift and 6. It skips the leading spaces.",
        done: (p) => p.cursor.col === 4 && typed(p, "^"),
      },
    ],
  },

  {
    id: "fileends",
    title: "Top and bottom",
    blurb:
      "gg goes to the first line, G to the last. Put a number in front of G and you jump straight to that line.",
    file: {
      path: `${DOJO}/scene.cpp`,
      lines: [
        "Scene build_default_scene() {",
        "  Scene scene;",
        "  Material ground;",
        "  ground.albedo = Color(0.45, 0.48, 0.42);",
        "  int ground_id = scene.add_material(ground);",
        "  scene.add_sphere(Point3(0, -100.5, 0), 100.0, ground_id);",
        "  return scene;",
        "}",
      ],
    },
    checkpoints: [
      {
        goal: "Drop to the last line of the file",
        keys: ["G"],
        hint: "Shift and g.",
        done: (p) => p.cursor.line === p.lines.length - 1,
      },
      {
        goal: "Fly back to the first line",
        keys: ["gg"],
        hint: "Press g twice.",
        done: (p) => p.cursor.line === 0 && typed(p, "g"),
      },
      {
        goal: "Jump directly to line 5",
        keys: ["5G"],
        hint: "Type 5 then Shift and g.",
        done: (p) => p.cursor.line === 4 && typed(p, "5"),
      },
    ],
  },

  {
    id: "find",
    title: "Find on the line",
    blurb:
      "f jumps to the next given character on this line. t stops just before it. Semicolon repeats the jump, comma reverses it.",
    file: {
      path: `${DOJO}/args.cpp`,
      lines: [
        "camera.set_aperture(0.05, 1.2, focal_length, samples);",
        "film.set(x, y, tonemap(color));",
      ],
    },
    checkpoints: [
      {
        goal: "Jump to the first comma on the line",
        keys: ["f,"],
        hint: "Press f then a comma.",
        done: (p) => charAt(p) === "," && p.cursor.line === 0,
      },
      {
        goal: "Repeat that jump to the next comma",
        keys: [";"],
        hint: "A semicolon repeats the last f, F, t or T.",
        done: (p) => charAt(p) === "," && p.cursor.col > 24 && typed(p, ";"),
      },
      {
        goal: "Stop just before the closing paren",
        keys: ["t)"],
        hint: "Press t then a closing paren. t means till.",
        done: (p) => typed(p, "t") && (p.lines[p.cursor.line] ?? "")[p.cursor.col + 1] === ")",
      },
    ],
  },

  {
    id: "brackets",
    title: "Bouncing on brackets",
    blurb:
      "% hops between a bracket and its partner. In a language made of braces this is how you read a block without scrolling.",
    file: {
      path: `${DOJO}/loop.cpp`,
      lines: [
        "for (int y = 0; y < height; ++y) {",
        "  for (int x = 0; x < width; ++x) {",
        "    Color c = trace(scene, camera.ray_for(u, v), 12);",
        "    film.set(x, y, tonemap(c));",
        "  }",
        "}",
      ],
    },
    checkpoints: [
      {
        goal: "Bounce from the opening brace on line one to its partner",
        keys: ["%"],
        hint: "Put the cursor on the { at the end of line one, then press %.",
        done: (p) => p.cursor.line === 5 && charAt(p) === "}",
      },
      {
        goal: "Bounce back the other way",
        keys: ["%"],
        hint: "% works in both directions.",
        done: (p) => p.cursor.line === 0 && charAt(p) === "{",
      },
    ],
  },

  {
    id: "search",
    title: "Searching",
    blurb:
      "Slash starts a search, Enter runs it. n goes to the next hit, Shift and n goes back. This is how you actually move around a real file.",
    file: {
      path: `${DOJO}/render.cpp`,
      lines: [
        "Color trace(const Scene &scene, const Ray &ray, int depth) {",
        "  if (depth <= 0) {",
        "    return Color(0, 0, 0);",
        "  }",
        "  Hit hit;",
        "  if (!scene.hit(ray, 0.001, 1e9, &hit)) {",
        "    return background(ray);",
        "  }",
        "  const Material &material = scene.material(hit.material_id);",
        "  return material.albedo * trace(scene, bounce, depth - 1);",
        "}",
      ],
    },
    checkpoints: [
      {
        goal: "Search for the word material",
        keys: ["/", "Enter"],
        hint: "Type /material then press Enter.",
        done: (p) => p.search !== null && p.search.length >= 2,
      },
      {
        goal: "Jump to the next match",
        keys: ["n"],
        hint: "Lowercase n moves forward, uppercase N moves back.",
        done: (p) => typed(p, "n"),
      },
    ],
  },

  {
    id: "delete",
    title: "Deleting",
    blurb:
      "x removes the character under the cursor. dd removes a whole line. Both put what they took into the register, so you can put it back.",
    file: {
      path: `${DOJO}/junk.cpp`,
      lines: [
        "int width = 6400;",
        "// delete this whole comment line",
        "int height = 360;",
      ],
    },
    checkpoints: [
      {
        goal: "Remove one stray zero from the width",
        keys: ["x"],
        hint: "Put the cursor on a zero in 6400 and press x.",
        done: (p) => p.lines[0] === "int width = 640;",
      },
      {
        goal: "Delete the comment line entirely",
        keys: ["dd"],
        hint: "Move down to it, then press d twice.",
        done: (p) => !text(p).includes("delete this whole comment"),
      },
    ],
  },

  {
    id: "operators",
    title: "Operator plus motion",
    blurb:
      "This is the grammar the whole editor is built on. d is delete, and it waits for a motion to tell it how far. dw deletes a word, d$ deletes to the end of the line.",
    file: {
      path: `${DOJO}/grammar.cpp`,
      lines: [
        "double unused_scratch_value = compute();",
        "film.write_ppm(std::cout); // trailing noise here",
      ],
    },
    checkpoints: [
      {
        goal: "Delete the word double from the front of line one",
        keys: ["dw"],
        hint: "Cursor at the start of the line, then d then w.",
        done: (p) => p.lines[0] === "unused_scratch_value = compute();",
      },
      {
        goal: "Delete the trailing comment on line two",
        keys: ["d$"],
        hint: "Move onto the slash that starts the comment, then press d then $.",
        done: (p) => p.lines[1]?.trimEnd() === "film.write_ppm(std::cout);",
      },
    ],
  },

  {
    id: "counts",
    title: "Counts",
    blurb:
      "Any command takes a number in front. 3dw deletes three words. 5j goes down five lines. The number multiplies whatever comes next.",
    file: {
      path: `${DOJO}/counts.cpp`,
      lines: [
        "const const const double gamma = 2.2;",
        "line two",
        "line three",
        "line four",
        "line five",
        "line six",
      ],
    },
    checkpoints: [
      {
        goal: "Delete the three repeated const words in one command",
        keys: ["3dw"],
        hint: "Type 3 then d then w.",
        done: (p) => p.lines[0] === "double gamma = 2.2;",
      },
      {
        goal: "Move down five lines in one command",
        keys: ["5j"],
        hint: "Type 5 then j.",
        done: (p) => p.cursor.line === 5 && typed(p, "5"),
      },
    ],
  },

  {
    id: "change",
    title: "Changing",
    blurb:
      "c is delete and insert in one move. cw wipes a word and drops you into insert mode ready to type the replacement.",
    file: {
      path: `${DOJO}/rename.cpp`,
      lines: [
        "int placeholder = 0;",
        "return oldname(scene, ray);",
      ],
    },
    checkpoints: [
      {
        goal: "Change placeholder into samples",
        keys: ["cw", "Esc"],
        hint: "Put the cursor on placeholder, press c then w, type samples, then press Escape.",
        done: (p) => p.lines[0] === "int samples = 0;" && p.mode === "normal",
      },
      {
        goal: "Change everything from oldname to the end of line two",
        keys: ["c$", "Esc"],
        hint: "Move onto the o of oldname, press c then $, type the new call, then Escape.",
        done: (p) =>
          p.mode === "normal" &&
          p.lines[1] !== "return oldname(scene, ray);" &&
          p.lines[1]?.startsWith("return ") === true,
      },
    ],
  },

  {
    id: "inner",
    title: "Inner text objects",
    blurb:
      "The real unlock. iw means inner word, and the cursor can be anywhere inside it. i then a quote means everything between the quotes. You stop aiming.",
    file: {
      path: `${DOJO}/objects.cpp`,
      lines: [
        "Material brass;",
        "brass.name = \"replace me\";",
        "brass.roughness = wrongvalue;",
      ],
    },
    checkpoints: [
      {
        goal: "Change what is inside the quotes",
        keys: ["ci\"", "Esc"],
        hint: "Put the cursor anywhere between the quotes, press c i and a double quote, type, then Escape.",
        done: (p) =>
          p.mode === "normal" &&
          /^brass\.name = "[^"]*";$/.test(p.lines[1] ?? "") &&
          !p.lines[1]?.includes("replace me"),
      },
      {
        goal: "Change the word wrongvalue without aiming at its first letter",
        keys: ["ciw", "Esc"],
        hint: "Land anywhere in the word, then c i w.",
        done: (p) =>
          p.mode === "normal" &&
          p.lines[2]?.startsWith("brass.roughness = ") === true &&
          !p.lines[2]?.includes("wrongvalue"),
      },
    ],
  },

  {
    id: "around",
    title: "Around text objects",
    blurb:
      "a is the greedy sibling of i. aw takes the word and the space after it. a then a paren takes the brackets as well as their contents.",
    file: {
      path: `${DOJO}/around.cpp`,
      lines: [
        "double value = extra noisy words here;",
        "Ray r = Ray(origin, direction);",
      ],
    },
    checkpoints: [
      {
        goal: "Delete the word noisy together with its trailing space",
        keys: ["daw"],
        hint: "Cursor anywhere in noisy, then d a w.",
        done: (p) => p.lines[0] === "double value = extra words here;",
      },
      {
        goal: "Delete the parens on line two along with what is inside them",
        keys: ["da("],
        hint: "Cursor inside the parens, then d a and an opening paren.",
        done: (p) => p.lines[1] === "Ray r = Ray;",
      },
    ],
  },

  {
    id: "yank",
    title: "Yank and put",
    blurb:
      "Copying is called yanking. yy takes a line, p puts it back after the cursor, uppercase P puts it before. Deletes fill the same register, so dd then p moves a line.",
    file: {
      path: `${DOJO}/yank.cpp`,
      lines: [
        "scene.add_sphere(Point3(0, 0, 0), 0.5, brass_id);",
        "return scene;",
      ],
    },
    checkpoints: [
      {
        goal: "Yank the first line",
        keys: ["yy"],
        hint: "Press y twice.",
        done: (p) => typed(p, "y"),
      },
      {
        goal: "Put a copy of it below",
        keys: ["p"],
        hint: "Press p. You should now have two identical add_sphere lines.",
        done: (p) =>
          p.lines.filter((l) => l.includes("add_sphere")).length >= 2,
      },
    ],
  },

  {
    id: "undo",
    title: "Undo and redo",
    blurb:
      "u steps back through your changes. Control and r steps forward again. Knowing undo is what makes experimenting cheap.",
    file: {
      path: `${DOJO}/undo.txt`,
      lines: ["keep this line exactly as it is", "scratch line"],
    },
    checkpoints: [
      {
        goal: "Delete the first line, then bring it back",
        keys: ["dd", "u"],
        hint: "Press d twice, then press u.",
        done: (p) =>
          typed(p, "u") && p.lines[0] === "keep this line exactly as it is",
      },
      {
        goal: "Redo the delete you just undid",
        keys: ["Ctrl r"],
        hint: "Hold Control and press r.",
        done: (p) => p.lines[0] !== "keep this line exactly as it is",
      },
    ],
  },

  {
    id: "dot",
    title: "The dot command",
    blurb:
      "A single dot repeats your last change. Make one good edit, then walk to the next spot and tap the dot. This is where vi starts to feel fast.",
    file: {
      path: `${DOJO}/dot.cpp`,
      lines: [
        "int aa = 0;",
        "int bb = 0;",
        "int cc = 0;",
        "int dd = 0;",
      ],
    },
    checkpoints: [
      {
        goal: "Change the first 0 into 1",
        keys: ["ciw", "Esc"],
        hint: "Put the cursor on the 0, press c i w, type 1, then Escape.",
        done: (p) => p.lines[0] === "int aa = 1;",
      },
      {
        goal: "Repeat that same edit on the next three lines",
        keys: ["j", "."],
        hint: "Move down, put the cursor on the 0, press the dot. Then again, and again.",
        done: (p) =>
          p.lines[1] === "int bb = 1;" &&
          p.lines[2] === "int cc = 1;" &&
          p.lines[3] === "int dd = 1;",
      },
    ],
  },

  {
    id: "open",
    title: "Making room",
    blurb:
      "o opens a fresh line below and starts insert mode there. Uppercase O opens above. a appends after the cursor, uppercase A jumps to the end of the line first.",
    file: {
      path: `${DOJO}/open.cpp`,
      lines: ["#include \"vec3.h\"", "", "namespace rt {", "}"],
    },
    checkpoints: [
      {
        goal: "Open a new line below the include and write something",
        keys: ["o", "Esc"],
        hint: "Press o, type an include or anything else, then Escape.",
        done: (p) => p.mode === "normal" && p.lines.length > 4,
      },
      {
        goal: "Append a comment to the end of the namespace line",
        keys: ["A", "Esc"],
        hint: "Put the cursor on the namespace line, press Shift and a, type, then Escape.",
        done: (p) => {
          const line = p.lines.find((l) => l.startsWith("namespace rt {"));
          return p.mode === "normal" && line !== undefined && line.length > "namespace rt {".length;
        },
      },
    ],
  },

  {
    id: "visual",
    title: "Visual mode",
    blurb:
      "When you want to see the range before you act on it, press v and move. Uppercase V grabs whole lines. Then any operator applies to what is lit up.",
    file: {
      path: `${DOJO}/visual.cpp`,
      lines: [
        "int keep_me = 1;",
        "int remove_one = 2;",
        "int remove_two = 3;",
        "int keep_me_too = 4;",
      ],
    },
    checkpoints: [
      {
        goal: "Enter visual line mode",
        keys: ["V"],
        hint: "Shift and v. The status line says VISUAL LINE.",
        done: (p) => p.mode === "vline",
      },
      {
        goal: "Select both remove lines and delete them",
        keys: ["j", "d"],
        hint: "From the first remove line press Shift and v, then j, then d.",
        done: (p) =>
          !text(p).includes("remove_one") && !text(p).includes("remove_two"),
      },
    ],
  },

  {
    id: "indent",
    title: "Indenting",
    blurb:
      "Two angle brackets shift a line right, two the other way shift it left. Both take counts and both work on a visual selection.",
    file: {
      path: `${DOJO}/indent2.cpp`,
      lines: [
        "if (found) {",
        "out->t = root;",
        "out->point = ray.at(root);",
        "}",
      ],
    },
    checkpoints: [
      {
        goal: "Indent the two lines inside the braces",
        keys: [">>"],
        hint: "On line two press the angle bracket twice, then do the same on line three. Or press Shift and v, j, then one angle bracket.",
        done: (p) =>
          p.lines[1]?.startsWith("  out->t") === true &&
          p.lines[2]?.startsWith("  out->point") === true,
      },
    ],
  },

  {
    id: "save",
    title: "Saving and leaving",
    blurb:
      "A colon opens the command line. w writes, q quits, wq does both. If vi refuses to quit it is because you have unsaved work, and adding an exclamation mark overrides it.",
    file: {
      path: `${DOJO}/finish.cpp`,
      lines: [
        "// change one thing, then save and quit",
        "int samples = 16;",
      ],
    },
    checkpoints: [
      {
        goal: "Make any change to the file",
        keys: ["any edit"],
        hint: "Change the sample count, or add a line. Anything counts.",
        done: (p) => p.dirty,
      },
      {
        goal: "Write the file without leaving",
        keys: [":w"],
        hint: "Type a colon, then w, then Enter. The status line reports the bytes written.",
        done: (p) => !p.dirty && savedText(p) !== "// change one thing, then save and quit\nint samples = 16;",
      },
      {
        goal: "Quit back to the shell",
        keys: [":q"],
        hint: "Colon, q, Enter. Or use :wq to write and quit in one go.",
        done: (p) => p.screen === "shell",
      },
    ],
  },
];

export const TOTAL_CHECKPOINTS = LESSONS.reduce(
  (sum, lesson) => sum + lesson.checkpoints.length,
  0,
);
