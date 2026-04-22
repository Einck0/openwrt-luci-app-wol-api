include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wol-api
PKG_VERSION:=0.2.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Einck

LUCI_TITLE:=LuCI support for WOL API
LUCI_DEPENDS:=+luci-base +rpcd +uhttpd +ucode +etherwake +curl
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
