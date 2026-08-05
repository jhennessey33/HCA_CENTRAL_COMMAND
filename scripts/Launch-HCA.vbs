Option Explicit

Dim shell, fso
Dim scriptFolder, repoRoot
Dim launcher, iconPath
Dim desktop, shortcutPath
Dim shortcut, command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Determine repository paths automatically
scriptFolder = fso.GetParentFolderName(WScript.ScriptFullName)
repoRoot = fso.GetParentFolderName(scriptFolder)

launcher = fso.BuildPath(scriptFolder, "hca-launcher.ps1")
iconPath = fso.BuildPath(repoRoot, "\public\assets\hca.ico")

' Create the desktop shortcut only if it does not already exist
desktop = shell.SpecialFolders("Desktop")
shortcutPath = fso.BuildPath(desktop, "HCA Central Command.lnk")

If Not fso.FileExists(shortcutPath) Then

    Set shortcut = shell.CreateShortcut(shortcutPath)

    shortcut.TargetPath = shell.ExpandEnvironmentStrings("%WINDIR%\System32\wscript.exe")
    shortcut.Arguments = """" & WScript.ScriptFullName & """"
    shortcut.WorkingDirectory = repoRoot
    shortcut.Description = "Launch HCA Central Command"

    If fso.FileExists(iconPath) Then
        shortcut.IconLocation = iconPath & ",0"
    End If

    shortcut.Save

End If

' Launch the HCA PowerShell launcher
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & launcher & """"

shell.Run command, 0, False