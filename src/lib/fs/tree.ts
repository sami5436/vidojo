import type { DirNode, FileNode, FsNode } from "./types";

const STAMP = "Sep 19 09:24";

function file(
  name: string,
  content: string,
  opts: { mode?: string; executable?: boolean } = {},
): FileNode {
  return {
    kind: "file",
    name,
    lines: content.replace(/\n$/, "").split("\n"),
    mode: opts.mode ?? (opts.executable ? "-rwxr-xr-x" : "-rw-r--r--"),
    mtime: STAMP,
    executable: opts.executable,
  };
}

function dir(name: string, entries: FsNode[] = [], mode = "drwxr-xr-x"): DirNode {
  const children: Record<string, FsNode> = {};
  for (const entry of entries) children[entry.name] = entry;
  return { kind: "dir", name, children, mode, mtime: STAMP };
}

const VEC3_H = `#pragma once

#include <cmath>
#include <iostream>

namespace rt {

struct Vec3 {
  double x = 0.0;
  double y = 0.0;
  double z = 0.0;

  Vec3() = default;
  Vec3(double x, double y, double z) : x(x), y(y), z(z) {}

  Vec3 operator+(const Vec3 &o) const { return Vec3(x + o.x, y + o.y, z + o.z); }
  Vec3 operator-(const Vec3 &o) const { return Vec3(x - o.x, y - o.y, z - o.z); }
  Vec3 operator*(double s) const { return Vec3(x * s, y * s, z * s); }
  Vec3 operator*(const Vec3 &o) const { return Vec3(x * o.x, y * o.y, z * o.z); }

  double length() const { return std::sqrt(x * x + y * y + z * z); }
  double length_squared() const { return x * x + y * y + z * z; }
};

inline double dot(const Vec3 &a, const Vec3 &b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

inline Vec3 cross(const Vec3 &a, const Vec3 &b) {
  return Vec3(a.y * b.z - a.z * b.y,
              a.z * b.x - a.x * b.z,
              a.x * b.y - a.y * b.x);
}

inline Vec3 normalize(const Vec3 &v) {
  double len = v.length();
  if (len == 0.0) {
    return Vec3(0.0, 0.0, 0.0);
  }
  return v * (1.0 / len);
}

inline std::ostream &operator<<(std::ostream &os, const Vec3 &v) {
  return os << "(" << v.x << ", " << v.y << ", " << v.z << ")";
}

using Color = Vec3;
using Point3 = Vec3;

}  // namespace rt
`;

const RAY_H = `#pragma once

#include "vec3.h"

namespace rt {

class Ray {
 public:
  Ray() = default;
  Ray(const Point3 &origin, const Vec3 &direction)
      : origin_(origin), direction_(normalize(direction)) {}

  const Point3 &origin() const { return origin_; }
  const Vec3 &direction() const { return direction_; }

  Point3 at(double t) const { return origin_ + direction_ * t; }

 private:
  Point3 origin_;
  Vec3 direction_;
};

struct Hit {
  double t = 0.0;
  Point3 point;
  Vec3 normal;
  int material_id = -1;
  bool front_face = true;
};

}  // namespace rt
`;

const CAMERA_H = `#pragma once

#include "ray.h"
#include "vec3.h"

namespace rt {

class Camera {
 public:
  Camera(const Point3 &look_from, const Point3 &look_at, double fov_degrees,
         double aspect);

  // u and v are screen coordinates in the range zero to one.
  Ray ray_for(double u, double v) const;

  void set_aperture(double aperture) { aperture_ = aperture; }
  double aperture() const { return aperture_; }

 private:
  Point3 origin_;
  Vec3 lower_left_;
  Vec3 horizontal_;
  Vec3 vertical_;
  double aperture_ = 0.0;
};

}  // namespace rt
`;

const SCENE_H = `#pragma once

#include <string>
#include <vector>

#include "ray.h"
#include "vec3.h"

namespace rt {

struct Material {
  std::string name = "matte";
  Color albedo = Color(0.8, 0.8, 0.8);
  double roughness = 1.0;
  double metallic = 0.0;
  double emission = 0.0;
};

struct Sphere {
  Point3 center;
  double radius = 1.0;
  int material_id = 0;
};

class Scene {
 public:
  void add_sphere(const Point3 &center, double radius, int material_id);
  int add_material(const Material &material);

  bool hit(const Ray &ray, double t_min, double t_max, Hit *out) const;

  const Material &material(int id) const { return materials_.at(id); }
  std::size_t sphere_count() const { return spheres_.size(); }

 private:
  std::vector<Sphere> spheres_;
  std::vector<Material> materials_;
};

Scene build_default_scene();

}  // namespace rt
`;

const MAIN_CPP = `#include <cstdlib>
#include <iostream>
#include <string>

#include "camera.h"
#include "render.h"
#include "scene.h"

namespace {

void print_usage(const char *program) {
  std::cout << "usage: " << program << " [width] [height] [samples]\\n";
  std::cout << "  width    image width in pixels, default 640\\n";
  std::cout << "  height   image height in pixels, default 360\\n";
  std::cout << "  samples  samples per pixel, default 16\\n";
}

int parse_or(const char *text, int fallback) {
  if (text == nullptr) {
    return fallback;
  }
  int value = std::atoi(text);
  return value > 0 ? value : fallback;
}

}  // namespace

int main(int argc, char **argv) {
  if (argc > 1 && std::string(argv[1]) == "--help") {
    print_usage(argv[0]);
    return 0;
  }

  int width = parse_or(argc > 1 ? argv[1] : nullptr, 640);
  int height = parse_or(argc > 2 ? argv[2] : nullptr, 360);
  int samples = parse_or(argc > 3 ? argv[3] : nullptr, 16);

  rt::Scene scene = rt::build_default_scene();
  rt::Camera camera(rt::Point3(0, 1, 5), rt::Point3(0, 0, 0), 55.0,
                    static_cast<double>(width) / height);

  std::cerr << "rendering " << width << "x" << height << " at " << samples
            << " spp\\n";

  rt::Film film = rt::render(scene, camera, width, height, samples);
  film.write_ppm(std::cout);

  std::cerr << "done, traced " << scene.sphere_count() << " spheres\\n";
  return 0;
}
`;

const RENDER_H = `#pragma once

#include <ostream>
#include <vector>

#include "camera.h"
#include "scene.h"
#include "vec3.h"

namespace rt {

class Film {
 public:
  Film(int width, int height);

  void set(int x, int y, const Color &color);
  Color get(int x, int y) const;

  void write_ppm(std::ostream &out) const;

  int width() const { return width_; }
  int height() const { return height_; }

 private:
  int width_ = 0;
  int height_ = 0;
  std::vector<Color> pixels_;
};

Film render(const Scene &scene, const Camera &camera, int width, int height,
            int samples);

Color trace(const Scene &scene, const Ray &ray, int depth);

Color tonemap(const Color &linear);

}  // namespace rt
`;

const RENDER_CPP = `#include "render.h"

#include <algorithm>
#include <cmath>
#include <random>

namespace rt {
namespace {

double random_double() {
  static thread_local std::mt19937 engine(0xC0FFEE);
  static thread_local std::uniform_real_distribution<double> dist(0.0, 1.0);
  return dist(engine);
}

Vec3 random_unit_vector() {
  while (true) {
    Vec3 p(random_double() * 2 - 1, random_double() * 2 - 1,
           random_double() * 2 - 1);
    if (p.length_squared() < 1.0) {
      return normalize(p);
    }
  }
}

}  // namespace

Film::Film(int width, int height)
    : width_(width), height_(height), pixels_(width * height) {}

void Film::set(int x, int y, const Color &color) {
  pixels_[y * width_ + x] = color;
}

Color Film::get(int x, int y) const { return pixels_[y * width_ + x]; }

void Film::write_ppm(std::ostream &out) const {
  out << "P3\\n" << width_ << " " << height_ << "\\n255\\n";
  for (int y = 0; y < height_; ++y) {
    for (int x = 0; x < width_; ++x) {
      Color c = get(x, y);
      int r = static_cast<int>(std::clamp(c.x, 0.0, 1.0) * 255);
      int g = static_cast<int>(std::clamp(c.y, 0.0, 1.0) * 255);
      int b = static_cast<int>(std::clamp(c.z, 0.0, 1.0) * 255);
      out << r << " " << g << " " << b << "\\n";
    }
  }
}

Color tonemap(const Color &linear) {
  // Gamma two point two, applied per channel.
  return Color(std::pow(linear.x, 1.0 / 2.2), std::pow(linear.y, 1.0 / 2.2),
               std::pow(linear.z, 1.0 / 2.2));
}

Color trace(const Scene &scene, const Ray &ray, int depth) {
  if (depth <= 0) {
    return Color(0, 0, 0);
  }

  Hit hit;
  if (!scene.hit(ray, 0.001, 1e9, &hit)) {
    double t = 0.5 * (ray.direction().y + 1.0);
    return Color(1.0, 1.0, 1.0) * (1.0 - t) + Color(0.5, 0.7, 1.0) * t;
  }

  const Material &material = scene.material(hit.material_id);
  Vec3 scattered = hit.normal + random_unit_vector() * material.roughness;
  Color incoming = trace(scene, Ray(hit.point, scattered), depth - 1);
  return material.albedo * incoming + Color(1, 1, 1) * material.emission;
}

Film render(const Scene &scene, const Camera &camera, int width, int height,
            int samples) {
  Film film(width, height);

  for (int y = 0; y < height; ++y) {
    for (int x = 0; x < width; ++x) {
      Color accumulated(0, 0, 0);
      for (int s = 0; s < samples; ++s) {
        double u = (x + random_double()) / (width - 1);
        double v = (y + random_double()) / (height - 1);
        accumulated = accumulated + trace(scene, camera.ray_for(u, v), 12);
      }
      Color c = accumulated * (1.0 / samples);
      film.set(x, y, tonemap(c));
    }
  }

  return film;
}

}  // namespace rt
`;

const SCENE_CPP = `#include "scene.h"

#include <cmath>

namespace rt {

int Scene::add_material(const Material &material) {
  materials_.push_back(material);
  return static_cast<int>(materials_.size()) - 1;
}

void Scene::add_sphere(const Point3 &center, double radius, int material_id) {
  Sphere sphere;
  sphere.center = center;
  sphere.radius = radius;
  sphere.material_id = material_id;
  spheres_.push_back(sphere);
}

bool Scene::hit(const Ray &ray, double t_min, double t_max, Hit *out) const {
  bool found = false;
  double closest = t_max;

  for (const Sphere &sphere : spheres_) {
    Vec3 oc = ray.origin() - sphere.center;
    double a = ray.direction().length_squared();
    double half_b = dot(oc, ray.direction());
    double c = oc.length_squared() - sphere.radius * sphere.radius;
    double discriminant = half_b * half_b - a * c;

    if (discriminant < 0) {
      continue;
    }

    double root = (-half_b - std::sqrt(discriminant)) / a;
    if (root < t_min || root > closest) {
      root = (-half_b + std::sqrt(discriminant)) / a;
      if (root < t_min || root > closest) {
        continue;
      }
    }

    found = true;
    closest = root;
    out->t = root;
    out->point = ray.at(root);
    out->normal = normalize(out->point - sphere.center);
    out->material_id = sphere.material_id;
    out->front_face = dot(ray.direction(), out->normal) < 0;
  }

  return found;
}

Scene build_default_scene() {
  Scene scene;

  Material ground;
  ground.name = "ground";
  ground.albedo = Color(0.45, 0.48, 0.42);
  int ground_id = scene.add_material(ground);

  Material brass;
  brass.name = "brass";
  brass.albedo = Color(0.82, 0.64, 0.28);
  brass.metallic = 0.9;
  brass.roughness = 0.15;
  int brass_id = scene.add_material(brass);

  Material lamp;
  lamp.name = "lamp";
  lamp.albedo = Color(1.0, 0.94, 0.86);
  lamp.emission = 4.0;
  int lamp_id = scene.add_material(lamp);

  scene.add_sphere(Point3(0, -100.5, 0), 100.0, ground_id);
  scene.add_sphere(Point3(0, 0, 0), 0.5, brass_id);
  scene.add_sphere(Point3(1.1, 0, -0.4), 0.5, ground_id);
  scene.add_sphere(Point3(-1.1, 0.2, -0.4), 0.7, lamp_id);

  return scene;
}

}  // namespace rt
`;

const CAMERA_CPP = `#include "camera.h"

#include <cmath>

namespace rt {

Camera::Camera(const Point3 &look_from, const Point3 &look_at,
               double fov_degrees, double aspect) {
  double theta = fov_degrees * 3.14159265358979323846 / 180.0;
  double half_height = std::tan(theta / 2);
  double half_width = aspect * half_height;

  Vec3 up(0, 1, 0);
  Vec3 w = normalize(look_from - look_at);
  Vec3 u = normalize(cross(up, w));
  Vec3 v = cross(w, u);

  origin_ = look_from;
  lower_left_ = origin_ - u * half_width - v * half_height - w;
  horizontal_ = u * (2 * half_width);
  vertical_ = v * (2 * half_height);
}

Ray Camera::ray_for(double u, double v) const {
  Vec3 target = lower_left_ + horizontal_ * u + vertical_ * v;
  return Ray(origin_, target - origin_);
}

}  // namespace rt
`;

const TEST_VEC3 = `#include "vec3.h"

#include <cassert>
#include <cmath>
#include <iostream>

namespace {

bool nearly(double a, double b) { return std::fabs(a - b) < 1e-9; }

void test_addition() {
  rt::Vec3 a(1, 2, 3);
  rt::Vec3 b(4, 5, 6);
  rt::Vec3 sum = a + b;
  assert(nearly(sum.x, 5));
  assert(nearly(sum.y, 7));
  assert(nearly(sum.z, 9));
}

void test_dot() {
  rt::Vec3 a(1, 0, 0);
  rt::Vec3 b(0, 1, 0);
  assert(nearly(dot(a, b), 0.0));
  assert(nearly(dot(a, a), 1.0));
}

void test_normalize() {
  rt::Vec3 v(0, 3, 4);
  rt::Vec3 n = normalize(v);
  assert(nearly(n.length(), 1.0));
}

}  // namespace

int main() {
  test_addition();
  test_dot();
  test_normalize();
  std::cout << "all vec3 tests passed\\n";
  return 0;
}
`;

const MAKEFILE = `CXX      := g++
CXXFLAGS := -std=c++17 -O2 -Wall -Wextra -Iinclude
SRC      := $(wildcard src/*.cpp)
OBJ      := $(SRC:src/%.cpp=build/%.o)
TARGET   := build/raytracer

.PHONY: all clean test run

all: $(TARGET)

$(TARGET): $(OBJ)
	$(CXX) $(CXXFLAGS) -o $@ $^

build/%.o: src/%.cpp
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -c $< -o $@

test: build/test_vec3
	./build/test_vec3

build/test_vec3: tests/test_vec3.cpp
	@mkdir -p build
	$(CXX) $(CXXFLAGS) -o $@ $<

run: $(TARGET)
	./$(TARGET) 320 180 8 > out.ppm

clean:
	rm -rf build out.ppm
`;

const PROJECT_README = `# raytracer

A small path tracer, about nine hundred lines of C++17, written to be read.

## layout

    include/   headers, one per concept
    src/       implementation
    tests/     assert based tests, no framework

## build

    make            build build/raytracer
    make test       build and run the vec3 tests
    make run        render a small preview into out.ppm
    make clean      throw away build output

## known rough edges

Camera has no depth of field yet even though aperture is stored.
Scene::hit walks every sphere, so it is linear in sphere count.
Sampling is uniform, which is noisy at low sample counts.
`;

const TODO = `# todo

[ ] give Camera a real aperture so depth of field works
[ ] swap the linear Scene::hit loop for a bounding volume hierarchy
[ ] importance sample the lamp instead of firing rays blindly
[ ] Film::write_ppm should take a path, not an ostream
[x] move tonemap out of render and into its own function
[x] stop seeding the rng per pixel
`;

const NOTES = `vi notes, kept because I keep forgetting

normal mode is home. insert mode is a visit.
press Esc more often than feels necessary.

motions
  h j k l     left down up right
  w b e       by word
  0 ^ $       start of line, first word, end of line
  gg G        top of file, bottom of file
  f x         jump to the next x on this line
  %           bounce to the matching bracket

operators take a motion
  d w         delete a word
  c $         change to end of line
  y y         yank a whole line
  3 d w       delete three words

text objects are the real unlock
  ciw         change inner word, cursor can be anywhere in it
  di"         delete inside the quotes
  ca(         change around the parens, brackets included

undo is u. redo is ctrl r. repeat the last change with a dot.
`;

const VIMRC = `set nocompatible
set number
set relativenumber
set expandtab
set shiftwidth=2
set tabstop=2
set incsearch
set hlsearch
set ignorecase
set smartcase
set scrolloff=4

syntax on
filetype plugin indent on

" stop reaching for the arrow keys
nnoremap <Up>    <Nop>
nnoremap <Down>  <Nop>
nnoremap <Left>  <Nop>
nnoremap <Right> <Nop>
`;

const BASHRC = `# .bashrc

export EDITOR=vi
export PATH=$HOME/bin:/usr/local/bin:/usr/bin:/bin

alias ll='ls -la'
alias ..='cd ..'
alias gs='git status'
alias mk='make -j4'

PS1='\\u@\\h:\\w\\$ '
`;

const ETC_MOTD = `Welcome to vidojo.

This is a simulated Linux box. Nothing here touches your real machine.
The raytracer project in ~/raytracer is yours to break and repair.

Type help for the commands this shell understands.
Type vi <file> to open something. Type :q to come back here.
`;

export function buildRoot(): DirNode {
  return dir("/", [
    dir("bin"),
    dir("etc", [file("motd", ETC_MOTD), file("hostname", "vidojo\n")]),
    dir("tmp"),
    dir("usr", [dir("bin"), dir("share", [dir("doc")])]),
    dir("var", [dir("log", [file("boot.log", "vidojo userspace ready\n")])]),
    dir("home", [
      dir(
        "sami",
        [
          file(".bashrc", BASHRC),
          file(".vimrc", VIMRC),
          file("notes.txt", NOTES),
          file("TODO.md", TODO),
          dir("raytracer", [
            file("Makefile", MAKEFILE),
            file("README.md", PROJECT_README),
            dir("include", [
              file("vec3.h", VEC3_H),
              file("ray.h", RAY_H),
              file("camera.h", CAMERA_H),
              file("scene.h", SCENE_H),
              file("render.h", RENDER_H),
            ]),
            dir("src", [
              file("main.cpp", MAIN_CPP),
              file("render.cpp", RENDER_CPP),
              file("scene.cpp", SCENE_CPP),
              file("camera.cpp", CAMERA_CPP),
            ]),
            dir("tests", [file("test_vec3.cpp", TEST_VEC3)]),
            dir("build"),
          ]),
        ],
        "drwxr-xr-x",
      ),
    ]),
  ]);
}

export { file as makeFile, dir as makeDir };
