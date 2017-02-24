require 'shrimp/version'
require 'shrimp/source'
require 'shrimp/phantom'
require 'shrimp/middleware'
require 'shrimp/configuration'
require 'mono_logger'

module Shrimp
  extend self

  attr_accessor :logger
end

Shrimp.logger = MonoLogger.new(STDOUT)