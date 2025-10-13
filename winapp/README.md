# Windows application build guide:
You will need to install typescript, install it using\
`npm install typescript --save-dev`\

## Testing 
After it is installed you can test it using \
`npm run dev`
> this command wont build the entire application, rather it will only get the base ready to test the functionality of the app. \

## To build the App for windows

Now that the testing is done and you want to build the application, run \
`npm run dist:win`\

This may take some time, and if you are getting some errors one common way to fix it is by running the script as administrator.

> Note that you may have to install Microsoft Visual Studio Build tools, in which you will need desktop development using c++ package.\
Also you may have to install different packages that has been used in this application.

## Directory Structure
In the winapp folder, the main folder which has the codes is the "src" folder. \
In the `src` folder, there are 2 subfolders, `electron` and `ui`. As the name suggests, `electron` has the code which will be running on the app while `ui` will be having the ui elements.\

For a more modular system, the frontend will be written in the `ui` section, while the interaction with the system and all system calls will be in the `electron`. 