include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-wol-api
PKG_VERSION:=0.2.1
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Einck
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for WOL API
  DEPENDS:=+luci-base +rpcd +uhttpd +ucode +etherwake +curl
  PKGARCH:=all
endef

define Package/$(PKG_NAME)/description
 A LuCI app providing WOL API configuration and wake endpoint support.
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./htdocs $(PKG_BUILD_DIR)/
	$(CP) ./root $(PKG_BUILD_DIR)/
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/wol-api
endef

define Package/$(PKG_NAME)/install
	$(CP) $(PKG_BUILD_DIR)/root/* $(1)/
	$(INSTALL_DIR) $(1)/www
	$(CP) $(PKG_BUILD_DIR)/htdocs/luci-static $(1)/www/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
