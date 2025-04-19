package utils

import (
	"context"
	"log"
	"strconv"

	"github.com/MarinX/keylogger"
	"golang.design/x/clipboard"
)

func MonitorKeyboardGlobal() {
	eventPath := keylogger.FindKeyboardDevice()
	if eventPath == "" {
		log.Fatal("No keyboard found")
	}

	keyLogger, err := keylogger.New(eventPath)
	if err != nil {
		log.Fatal("Failed to open keyboard:", err)
	}

	keysPressed := map[string]bool{}

	if clErr := clipboard.Init(); clErr != nil {
		log.Fatal(clErr)
	}

	db := Db{}
	if err := db.New(); err != nil {
		log.Fatal(err)
	}

	// Start the clipboard monitoring in a separate goroutine
	go MonitorClipboardChanges(&db)

	for event := range keyLogger.Read() {
		key := event.KeyString()

		if event.Type == keylogger.EvKey {
			if event.Value == 1 {
				keysPressed[key] = true
			}
			if event.Value == 0 {
				keysPressed[key] = false
			}

			isCtrl := keysPressed["L_CTRL"] || keysPressed["R_CTRL"]
			isShift := keysPressed["L_SHIFT"] || keysPressed["R_SHIFT"]

			// Handle Ctrl + Shift + [1-9]
			if isCtrl && isShift {
				for i := 1; i <= 9; i++ {
					keyStr := strconv.Itoa(i)
					if keysPressed[keyStr] {
						items, err := db.FetchAllItems()
						if err != nil {
							log.Println("Error fetching items:", err)
							continue
						}
						if i > len(items) {
							log.Printf("No item at position %d\n", i)
							continue
						}

						selected := items[i-1].Content
						newList := []string{selected}
						for _, item := range items {
							if item.Content != selected {
								newList = append(newList, item.Content)
							}
						}

						db.UpdateAllItems(newList)

						clipboard.Write(clipboard.FmtText, []byte(selected)) // set new #1 as clipboard
					}
				}
			}

		}
	}
}

// MonitorClipboardChanges watches for any changes to the clipboard content
func MonitorClipboardChanges(db *Db) {
	// Create a channel to receive clipboard change notifications
	ch := clipboard.Watch(context.Background(), clipboard.FmtText)

	var lastContent string

	for data := range ch {
		clipboardText := string(data)

		// Skip if clipboard is empty or same as last content
		if clipboardText == "" || clipboardText == lastContent {
			continue
		}

		log.Printf("Clipboard changed, new content: %s", clipboardText[:min(20, len(clipboardText))])
		lastContent = clipboardText

		// Update database
		items, err := db.FetchAllItems()
		if err != nil {
			log.Println("Error fetching items:", err)
			continue
		}

		// Check if content already at position 1
		if len(items) > 0 && items[0].Content == clipboardText {
			log.Println("Content already at top position, no update needed")
			continue
		}

		newList := []string{clipboardText}
		for _, item := range items {
			if item.Content != clipboardText {
				newList = append(newList, item.Content)
			}
		}

		db.UpdateAllItems(newList)
	}
}

// Helper function for string length limiting
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
