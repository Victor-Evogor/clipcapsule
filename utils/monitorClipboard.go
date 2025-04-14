package utils

import (
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

			// Handle Ctrl+C
			if isCtrl && keysPressed["C"] {
				clipboardText := string(clipboard.Read(clipboard.FmtText))
				if clipboardText != "" {
					items, err := db.FetchAllItems()
					if err != nil {
						log.Println("Error fetching items:", err)
						continue
					}

					newList := []string{clipboardText}
					for _, item := range items {
						if item.Content != clipboardText {
							newList = append(newList, item.Content)
						}
					}

					err = db.UpdateAllItems(newList)
					if err != nil {
						log.Println("Failed to update clipboard history:", err)
					} else {
						log.Println("Copied text saved at position 1:", clipboardText)
						clipboard.Write(clipboard.FmtText, []byte(clipboardText)) // ensure it's still the current clipboard
					}
				}
			}

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

						err = db.UpdateAllItems(newList)
						if err != nil {
							log.Println("Failed to move item to position 1:", err)
						} else {
							log.Printf("Moved #%d item to top: %s\n", i, selected)
							clipboard.Write(clipboard.FmtText, []byte(selected)) // set new #1 as clipboard
						}
					}
				}
			}
		}
	}
}
