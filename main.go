package main

import (
	"clipcapsule/utils"
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed favicon.ico
var logo_embed embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()

	go utils.MonitorKeyboardGlobal()

	logo, logo_err := logo_embed.ReadFile("favicon.ico")
	if logo_err != nil {
		panic(logo_err)
	}

	// Create application with options
	err := wails.Run(&options.App{
		Title:            "clipcapsule",
		Width:            1024,
		Height:           768,
		Assets:           assets,
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
		Linux: &linux.Options{
			Icon:        logo,
			ProgramName: "clipcapsule",
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
