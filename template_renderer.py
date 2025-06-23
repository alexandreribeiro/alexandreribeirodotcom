import os
import shutil
from jinja2 import Environment, FileSystemLoader

root_build_folder = "_build"
build_folder_list = [root_build_folder, f"{root_build_folder}/world-map", f"{root_build_folder}/about",
                     f"{root_build_folder}/dashboard"]
assets_folder = "templates/assets"

if os.path.exists(root_build_folder):
    print(f"Deleting existing build folder: {root_build_folder}")
    shutil.rmtree(root_build_folder)
for folder_to_create in build_folder_list:
    print(f"Creating new build folder: {folder_to_create}")
    os.makedirs(folder_to_create)
print(f"Copying assets to {root_build_folder}")
shutil.copytree(assets_folder, os.path.join(root_build_folder, os.path.basename(assets_folder)))

jinja_environment = Environment(loader=FileSystemLoader('templates'))
jinja_environment.globals['ROOT_URL'] = ''

pages = [
    {
        "template": "pages/index.html",
        "output": "index.html",
        "data": {"selected_menu": "index"}
    },
    {
        "template": "pages/world-map/index.html",
        "output": "world-map/index.html",
        "data": {"selected_menu": "world-map"}
    },
    {
        "template": "pages/about/index.html",
        "output": "about/index.html",
        "data": {"selected_menu": "about"}
    },
    {
        "template": "pages/dashboard/index.html",
        "output": "dashboard/index.html",
        "data": {"selected_menu": "dashboard"}
    }
]

for page in pages:
    template = jinja_environment.get_template(page["template"])
    rendered_content = template.render(page["data"])
    with open("_build/" + page["output"], "w") as f:
        f.write(rendered_content)

print("Pages have been rendered successfully!")
