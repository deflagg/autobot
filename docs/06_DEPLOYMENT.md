# Deployment

## Install
```bash
curl -fsSL https://raw.githubusercontent.com/deflagg/autobot/master/install.sh | bash
```

## Uninstall
```bash
curl -fsSL https://raw.githubusercontent.com/deflagg/autobot/master/uninstall.sh | bash
```

## Daemon control (systemd user service)
The CLI commands call `systemctl --user` directly:
```bash
autobot daemon <start|stop|restart|status|logs>
```

## Upgrades
Re-run install script or pull latest source and rebuild.
